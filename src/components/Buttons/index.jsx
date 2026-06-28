export function PrimaryButton({ label, ...props }) {
  return (
    <button type="button" className="btn btn-primary" {...props}>
      {label}
    </button>
  );
}

export function SecondaryButton({ label, ...props }) {
  return (
    <button type="button" className="btn btn-secondary" {...props}>
      {label}
    </button>
  );
}
