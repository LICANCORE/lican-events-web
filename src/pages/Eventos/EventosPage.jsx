import ContactCTA from '../../components/ContactCTA';
import Newsletter from '../../components/Newsletter';
import PageHero from '../../components/PageHero';
import usePageTitle from '../../hooks/usePageTitle';
import useLanguage from '../../i18n/useLanguage';
import { BusinessCta, Parties, RealizedEvents } from '../Home/HomePage';
import '../Home/home.css';
import '../shared-pages.css';

export default function EventosPage() {
  const { t } = useLanguage();
  usePageTitle(t.pages.events.title, t.pages.events.description);

  return (
    <div className="content-page">
      <PageHero page="events" />
      <Parties />
      <div className="home-section shell"><Newsletter id="newsletter" /></div>
      <BusinessCta />
      <RealizedEvents />
      <ContactCTA />
    </div>
  );
}
