export function AmountCell({
  amount,
  className = "",
}: {
  amount: number;
  className?: string;
}) {
  const isNegative = amount < 0;

  const abs = Math.abs(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const display = isNegative ? `(${abs})` : abs;

  return (
    <span className={`${className} ${isNegative ? "text-red-600" : "text-green-600"}`}>
      {display}
    </span>
  );
}
