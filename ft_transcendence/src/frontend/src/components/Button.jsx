import { Link } from "react-router-dom";

export default function Button({
  children,
  onClick,
  variant = "blue",
  className = "",
  icon = null,
  to,
  ...props
}) {
  const classes = [
    "neon-button",
    variant === "orange" ? "neon-button-orange" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={classes} {...props}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
