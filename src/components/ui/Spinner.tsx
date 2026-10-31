/** A small spinner that takes the text colour of its button. Decorative: pair it with text that says what's happening. */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border-2 border-current border-r-transparent [animation:spin_700ms_linear_infinite] motion-reduce:[animation-duration:2s] ${className}`}
    />
  );
}
