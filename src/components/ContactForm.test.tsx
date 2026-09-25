import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/ContactForm";
import { INDUSTRIES } from "@/platform/types";

const REQUIRED = ["First name", "Last name", "Company name", "Phone number", "Email", "Industry"];

function fillIn() {
  const fill = (name: string, value: string) =>
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  fill("First name", " Ada ");
  fill("Last name", "Lovelace");
  fill("Company name", "Analytical Engines");
  fill("Phone number", "555-0100");
  fill("Email", "ada@example.com");
  fill("Industry", "Bar / Restaurant");
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
      expect(screen.getByLabelText(name)).toHaveProperty("required", true);
    }
    expect(screen.getByLabelText("Additional comments (optional)")).toHaveProperty(
      "required",
      false
    );
    expect(screen.getByLabelText("Email")).toHaveProperty("type", "email");
  });

  it("offers the client's industries in the client's order", () => {
    render(<ContactForm onSubmit={vi.fn()} />);

    const options = Array.from(screen.getByLabelText<HTMLSelectElement>("Industry").options).filter(
      (option) => !option.disabled
    );
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
