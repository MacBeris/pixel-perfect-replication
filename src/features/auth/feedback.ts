export function validateAuthForm(
  email: string,
  password: string,
  signup: boolean,
  username = "",
): { username?: string; email?: string; password?: string } {
  const fields: { username?: string; email?: string; password?: string } = {};
  if (signup && !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username.trim().toLowerCase()))
    fields.username = "Choose a username with 3–30 lowercase letters, numbers, _ or -.";
  if (!email) fields.email = "Enter your email address.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fields.email = "Enter a valid email address, such as you@gmail.com.";
  if (!password) fields.password = "Enter your password.";
  else if (signup && password.length < 8)
    fields.password = "Use at least 8 characters for your password.";
  return fields;
}

export function authErrorMessage(error: unknown): string {
  const value =
    error && typeof error === "object"
      ? (error as { code?: string; status?: number; name?: string })
      : {};
  switch (value.code) {
    case "invalid_credentials":
      return "The email or password is incorrect. Check both and try again.";
    case "email_not_confirmed":
      return "Confirm your email using the link in your inbox, then sign in. Check your spam folder too.";
    case "email_address_invalid":
    case "validation_failed":
      return "Check your email address and password, then try again.";
    case "email_address_not_authorized":
      return "Email delivery is not available for this address yet. Please contact ExtendShare support.";
    case "over_email_send_rate_limit":
      return "We cannot send another email right now. If you already have an account, use Sign in. Otherwise, try again later.";
    case "over_request_rate_limit":
      return "Too many requests in a short time. Wait a little before trying again. Your entries have been kept.";
    case "weak_password":
      return "Choose a stronger password with a mix of letters, numbers and symbols. Avoid common or reused passwords.";
    case "user_already_exists":
    case "email_exists":
      return "An account may already use this email. Try signing in instead.";
    case "unexpected_failure":
      return "That username may already be taken. Choose another username and try again.";
    case "signup_disabled":
      return "New registrations are temporarily unavailable. Existing accounts can still sign in.";
    case "user_banned":
      return "Sign-in is unavailable for this account. Please contact ExtendShare support.";
  }
  if (value.status === 429)
    return "Too many requests in a short time. Wait a little before trying again. Your entries have been kept.";
  if (value.name === "AuthRetryableFetchError" || value.name === "TypeError")
    return "We could not connect. Check your internet connection and try again.";
  return "We could not complete your request. Please try again in a moment.";
}
