import ContactCTA from '../../components/ContactCTA';
import usePageTitle from '../../hooks/usePageTitle';
import useLanguage from '../../i18n/useLanguage';
import { BusinessCta, Services } from '../Home/HomePage';
import '../Home/home.css';
import '../shared-pages.css';

export default function ServiciosPage() {
  const { t } = useLanguage();
  usePageTitle(t.pages.services.title, t.pages.services.description);

  return (
    <div className="content-page">
      <Services page />
      <BusinessCta hideServicesButton />
      <ContactCTA />
    </div>
  );
}
