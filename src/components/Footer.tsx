export default function Footer() {
  return (
    <footer className="bg-white border-t border-border mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <p className="text-text-light text-sm">
          &copy; {new Date().getFullYear()} 投資の&quot;KAWARA&quot;版.com All rights reserved.
        </p>
      </div>
    </footer>
  );
}
