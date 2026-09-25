import { useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { INDUSTRIES, type ContactDetails, type Industry } from "@/platform/types";
import "@/components/ContactForm.css";

type TextField = Exclude<keyof ContactDetails, "industry" | "comments">;

/** The required text fields, in the order the client listed them. */
const TEXT_FIELDS: {
  key: TextField;
  label: string;
  type: "text" | "tel" | "email";
  autoComplete: string;
}[] = [
  { key: "firstName", label: "First name", type: "text", autoComplete: "given-name" },
  { key: "lastName", label: "Last name", type: "text", autoComplete: "family-name" },
  { key: "company", label: "Company name", type: "text", autoComplete: "organization" },
  { key: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" }
];

export type ContactFormProps = {
  onSubmit: (details: ContactDetails) => Promise<{ error?: string }>;
};

/**
 * The form a visitor fills in before using the app for the first time
 * (ADR-0052). It cannot be dismissed. Every field is required except the
 * comments; the browser's own validation enforces that, including the email's
 * shape.
 */
export function ContactForm({ onSubmit }: ContactFormProps) {
  const [text, setText] = useState<Record<TextField, string>>({
    firstName: "",
    lastName: "",
    company: "",
    phone: "",
    email: ""
  });
  const [industry, setIndustry] = useState<Industry | "">("");
  const [comments, setComments] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    // Handled here rather than posted: there is no page to post to.
    event.preventDefault();
    if (industry === "" || sending) return;
    setSending(true);
    setError(null);
    const result = await onSubmit({
      firstName: text.firstName.trim(),
      lastName: text.lastName.trim(),
      company: text.company.trim(),
      phone: text.phone.trim(),
      email: text.email.trim(),
      industry,
      comments: comments.trim()
    });
    // On success the parent unmounts this form, so only a failure comes back.
    if (result.error) {
      setError(result.error);
      setSending(false);
    }
  }

  return (
    <Modal
      label="Welcome to PTSBLite"
      onClose={() => undefined}
      dismissOnBackdrop={false}
      size="md"
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="contact__logo" role="img" aria-label="Kelly Systems" />
        <div className="modal__header">
          <div className="modal__title">Welcome to PTSBLite</div>
        </div>
        <div className="contact__body">
          <p className="contact__intro">
            Tell us a little about yourself to start planning your system.
          </p>
          <div className="contact__fields">
            {TEXT_FIELDS.map(({ key, label, type, autoComplete }) => (
              <label key={key} className="contact__field">
                <span className="contact__label">{label}</span>
                <input
                  className="contact__input"
                  name={key}
                  type={type}
                  autoComplete={autoComplete}
                  required
                  value={text[key]}
                  onChange={(e) => setText({ ...text, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="contact__field">
              <span className="contact__label">Industry</span>
              <select
                className="contact__input"
                name="industry"
                required
                value={industry}
                onChange={(e) => setIndustry(e.target.value as Industry | "")}
              >
                <option value="" disabled>
                  Select an industry
                </option>
                {INDUSTRIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="contact__field contact__field--wide">
              <span className="contact__label">Additional comments (optional)</span>
              <textarea
                className="contact__input contact__textarea"
                name="comments"
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p className="contact__error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="contact__footer">
          <button className="topbtn primary" type="submit" disabled={sending}>
            {sending ? "Sending…" : "Continue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
