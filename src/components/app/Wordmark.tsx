/**
 * The app's name, set in its own typeface: "leica" in the wide display cut,
 * ".rt" quieter. Plain type by design: not Leica's script logo, not its red.
 */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark${className ? ` ${className}` : ""}`} role="img" aria-label="leica.rt">
      <span aria-hidden="true">leica</span>
      <span className="wordmark-rt" aria-hidden="true">
        .rt
      </span>
    </span>
  );
}
