/**
 * Digits in a sign-in code. Supabase emails a 6-digit code.
 * Local tests without Supabase stay on 4 so they don't need the network.
 */
export const CODE_LENGTH = process.env.NEXT_PUBLIC_SUPABASE_URL ? 6 : 4;
