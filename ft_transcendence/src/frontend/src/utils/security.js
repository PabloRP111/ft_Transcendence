export function validateEmail(email) {
  if (email.length > 100) {
    return { isValid: false, error: "Invalid format, Email too long" };
  }
  const formatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return { 
    isValid: formatValid, 
    error: formatValid ? null : "Invalid email format" 
  };
}

export function validatePassword(password) {
  const isValid = password && password.length >= 6;
  return { 
    isValid: isValid, 
    error: isValid ? null : "Invalid format, Password must be at least 6 characters" 
  };
}

export function validateUsername(username) {
  if (username.length > 20) {
    return { isValid: false, error: "Invalid format, Username too long" };
  }
  const formatValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  return { 
    isValid: formatValid, 
    error: formatValid ? null : "Invalid format, Username must be 3-20 characters (alphanumeric)" 
  };
}

// Avoid HTML basic injection
export function sanitizeSearch(input) {
  return input
    .replace(/[<>]/g, "")
    .replace(/['"`;]/g, "")
    .trim()
    .slice(0, 50);
}
