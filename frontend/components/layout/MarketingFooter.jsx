import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function MarketingFooter() {
  return (
    <footer className="w-full border-t border-outline-variant bg-surface py-section-gap">
      <div className="mx-auto flex max-w-container-max flex-col items-start justify-between gap-gutter px-margin-mobile md:flex-row md:px-margin-desktop">
        <div className="max-w-sm space-y-6">
          <div className="text-headline-lg-mobile font-bold text-on-surface">
            DISHA AI
          </div>
          <p className="text-body-md text-secondary">
            © 2024 DISHA AI. Guided Clarity for Nepal&apos;s Future.
          </p>
          <div className="flex gap-4">
            <Link
              href="#"
              className="text-secondary transition-colors hover:text-primary"
              aria-label="Website"
            >
              <Icon name="public" />
            </Link>
            <Link
              href="#"
              className="text-secondary transition-colors hover:text-primary"
              aria-label="RSS"
            >
              <Icon name="rss_feed" />
            </Link>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-x-24 gap-y-8 md:mt-0">
          <div className="space-y-4">
            <h5 className="text-label-md font-bold text-primary">Platform</h5>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="text-label-sm text-secondary transition-colors hover:text-on-surface"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-label-sm text-secondary transition-colors hover:text-on-surface"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="text-label-md font-bold text-primary">Company</h5>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="text-label-sm text-secondary transition-colors hover:text-on-surface"
                >
                  University Partners
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-label-sm text-secondary transition-colors hover:text-on-surface"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="text-label-sm text-secondary transition-colors hover:text-on-surface"
                >
                  Admin
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
