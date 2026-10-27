/**
 * Digits in a sign-in code.
 *
 * The app's own code flow (on-screen demo codes, and codes it emails itself) uses 4 digits.
 * Supabase's email OTP can't go below 6, so while Supabase sends a person's code the code step
 * asks for 6. The server says which length applies to each sign-in (`requestCode` returns it).
 */
export const CODE_LENGTH = 4;
export const SUPABASE_CODE_LENGTH = 6;
