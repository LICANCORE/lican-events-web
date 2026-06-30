import ContactCTA from '../../components/ContactCTA';
import PageHero from '../../components/PageHero';
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
      <PageHero page="services" />
      <Services />
      <BusinessCta />
      <ContactCTA />
    </div>
  );
}
