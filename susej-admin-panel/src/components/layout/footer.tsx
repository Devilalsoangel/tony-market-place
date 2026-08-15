export function Footer() {
  return (
    <footer className="flex items-center justify-between bg-white px-6 py-3 text-xs text-[#A1A1AA]">
      <span>&copy; {new Date().getFullYear()} SUSEJ. All rights reserved.</span>
      <div className="flex items-center gap-4">
        <a href="#" className="transition-colors hover:text-[#18181B]">
          Privacy Policy
        </a>
        <a href="#" className="transition-colors hover:text-[#18181B]">
          Terms of Service
        </a>
      </div>
    </footer>
  );
}
