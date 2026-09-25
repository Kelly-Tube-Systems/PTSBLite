import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/ContactForm";
import { INDUSTRIES } from "@/platform/types";

const REQUIRED = ["First name", "Last name", "Company name", "Phone number", "Email"];

/** Fields are found by accessible name, which leaves out the required mark. */
const industry = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Industry" });

function fillIn() {
  const fill = (name: string, value: string) =>
    fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
  fill("First name", " Ada ");
  fill("Last name", "Lovelace");
  fill("Company name", "Analytical Engines");
  fill("Phone number", "555-0100");
  fill("Email", "ada@example.com");
  fireEvent.change(industry(), { target: { value: "Bar / Restaurant" } });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await Promise.resolve();
  });
}

describe("ContactForm", () => {
  it("requires every field except the comments", () => {
    render(<ContactForm onSubmit={vi.fn()} />);

    for (const name of REQUIRED) {
      expect(screen.getByRole("textbox", { name })).toHaveProperty("required", true);
    }
    expect(industry()).toHaveProperty("required", true);
    expect(screen.getByRole("textbox", { name: "Additional comments (optional)" })).toHaveProperty(
      "required",
      false
    );
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveProperty("type", "email");
  });

  it("marks exactly the required fields with an asterisk", () => {
    render(<ContactForm onSubmit={vi.fn()} />);

    const labels = Array.from(document.querySelectorAll("label"));
    expect(labels).toHaveLength(REQUIRED.length + 2);
    for (const label of labels) {
      const control = label.querySelector<HTMLInputElement>("input, select, textarea");
      const mark = label.querySelector(".contact__required");
      expect(mark?.textContent === "*").toBe(control?.required);
    }
  });

  it("offers the client's industries in the client's order", () => {
    render(<ContactForm onSubmit={vi.fn()} />);

    const options = Array.from(industry().options).filter((option) => !option.disabled);
    expect(options.map((option) => option.value)).toEqual([...INDUSTRIES]);
  });

  it("submits the trimmed details", async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<ContactForm onSubmit={onSubmit} />);

    fillIn();
    await submit();

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines",
      phone: "555-0100",
      email: "ada@example.com",
      industry: "Bar / Restaurant",
      comments: ""
    });
  });

  it("says why a submission failed and lets the visitor try again", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: "Could not send the form." });
    render(<ContactForm onSubmit={onSubmit} />);

    fillIn();
    await submit();

    expect(screen.getByRole("alert").textContent).toBe("Could not send the form.");
    expect(screen.getByRole("button", { name: "Continue" })).toHaveProperty("disabled", false);
  });
});
