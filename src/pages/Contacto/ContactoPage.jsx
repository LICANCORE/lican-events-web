import usePageTitle from '../../hooks/usePageTitle';
import useLanguage from '../../i18n/useLanguage';
import { Contact } from '../Home/HomePage';
import '../Home/home.css';
import '../shared-pages.css';

export default function ContactoPage() {
  const { t } = useLanguage();
  usePageTitle(t.pages.contact.title, t.pages.contact.description);

  return (
    <div className="content-page">
      <Contact page />
    </div>
  );
}
