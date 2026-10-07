/** "42 / 60" character counter for Google texts, red when too long */
export default function Counter({ value, max }: { value: string; max: number }) {
  return (
    <small className={value.length > max ? 'counter over' : 'counter'}>
      {value.length} / {max}
    </small>
  );
}
