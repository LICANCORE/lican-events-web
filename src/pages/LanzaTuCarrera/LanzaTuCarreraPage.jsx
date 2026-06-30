import ContactCTA from '../../components/ContactCTA';
import PageHero from '../../components/PageHero';
import usePageTitle from '../../hooks/usePageTitle';
import useLanguage from '../../i18n/useLanguage';
import { Artists } from '../Home/HomePage';
import '../Home/home.css';
import '../shared-pages.css';

export default function LanzaTuCarreraPage() {
  const { t } = useLanguage();
  usePageTitle(t.pages.artists.title, t.pages.artists.description);

  return (
    <div className="content-page">
      <PageHero page="artists" />
      <Artists />
      <ContactCTA artist />
    </div>
  );
}
