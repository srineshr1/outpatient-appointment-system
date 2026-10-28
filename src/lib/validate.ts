import { isIsoDate } from "./clock";
import { validatePhone } from "./phone";

export interface PatientForm {
  name: string;
  dob: string;
  mobile: string;
  chi: string;
  reasonId: string;
  note: string;
  isNew: boolean;
}

export type PatientErrors = Partial<Record<keyof PatientForm, string>>;

export const NOTE_LIMIT = 200;

export const EMPTY_FORM: PatientForm = {
  name: "",
  dob: "",
  mobile: "",
  chi: "",
  reasonId: "",
  note: "",
  isNew: false,
};

/** Field order used for the error summary and for focusing the first problem. */
export const FIELD_ORDER: (keyof PatientForm)[] = ["name", "dob", "mobile", "chi", "reasonId", "note"];

export function validateDob(dob: string, today: string): string | undefined {
  if (!dob) return "Enter a date of birth.";
  if (!isIsoDate(dob)) return "Enter a real date, such as 14 March 1980.";
  if (dob > today) return "That date is in the future.";
  if (dob < "1900-01-01") return "Check the year. We need a date after 1900.";
  return undefined;
}

export function validatePatient(values: PatientForm, today: string): PatientErrors {
  const errors: PatientErrors = {};

  if (!values.name.trim()) errors.name = "Enter the name of the person attending.";
  else if (values.name.trim().length > 100) errors.name = "Keep the name to 100 characters.";

  const dobError = validateDob(values.dob, today);
  if (dobError) errors.dob = dobError;

  const mobileError = validatePhone(values.mobile);
  if (mobileError) errors.mobile = mobileError;

  const chi = values.chi.replace(/\s/g, "");
  if (chi) {
    if (!/^\d{10}$/.test(chi)) {
      errors.chi = "A CHI number is 10 digits.";
    } else if (!errors.dob) {
      const [year, month, day] = values.dob.split("-") as [string, string, string];
      if (!chi.startsWith(`${day}${month}${year.slice(2)}`)) {
        errors.chi = "Those digits don’t match the date of birth.";
      }
    }
  }

  if (!values.reasonId) errors.reasonId = "Choose what the visit is for.";
  if (values.note.length > NOTE_LIMIT) errors.note = `Keep the note to ${NOTE_LIMIT} characters.`;

  return errors;
}
