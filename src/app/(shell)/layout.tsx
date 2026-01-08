import Shell from "@/components/Shell";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <div className="ll_shell_bg"><Shell>{children}</Shell></div>;
}
