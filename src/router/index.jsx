import { createBrowserRouter, Navigate } from 'react-router-dom';

import MainLayout from '../layouts/MainLayout';
import HomePage from '../pages/Home/HomePage';
import EventosPage from '../pages/Eventos/EventosPage';
import ServiciosPage from '../pages/Servicios/ServiciosPage';
import NuestrasFiestasPage from '../pages/NuestrasFiestas/NuestrasFiestasPage';
import FeralPage from '../pages/NuestrasFiestas/FERAL/FeralPage';
import HeadbangDealersPage from '../pages/NuestrasFiestas/HeadbangDealers/HeadbangDealersPage';
import NightOfSeriesPage from '../pages/NuestrasFiestas/NightOfSeries/NightOfSeriesPage';
import ColaboradoresPage from '../pages/Colaboradores/ColaboradoresPage';
import LanzaTuCarreraPage from '../pages/LanzaTuCarrera/LanzaTuCarreraPage';
import GaleriaPage from '../pages/Galeria/GaleriaPage';
import ContactoPage from '../pages/Contacto/ContactoPage';
import { getLegacyRouteEntries, getLocalizedPath, localizedRoutes } from '../i18n/languageRoutes';
import RouteRedirect from './RouteRedirect';

const pageComponents = {
  home: <HomePage />,
  events: <EventosPage />,
  services: <ServiciosPage />,
  artists: <LanzaTuCarreraPage />,
  gallery: <GaleriaPage />,
  contact: <ContactoPage />,
};

const createLocalizedChildren = (language) => {
  const { slugs } = localizedRoutes[language];
  const canonical = Object.entries(slugs).map(([pageKey, slug]) => (
    pageKey === 'home'
      ? { index: true, element: pageComponents.home }
      : { path: slug, element: pageComponents[pageKey] }
  ));
  const legacy = getLegacyRouteEntries(language)
    .filter(({ slug, pageKey }) => slug !== slugs[pageKey])
    .map(({ slug, pageKey }) => ({
      path: slug,
      element: <RouteRedirect to={getLocalizedPath(language, pageKey)} />,
    }));
  return [...canonical, ...legacy];
};

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      ...createLocalizedChildren('cast'),
      { path: 'nuestras-fiestas', element: <NuestrasFiestasPage /> },
      { path: 'nuestras-fiestas/feral', element: <FeralPage /> },
      { path: 'nuestras-fiestas/headbang-dealers', element: <HeadbangDealersPage /> },
      { path: 'nuestras-fiestas/night-of-series', element: <NightOfSeriesPage /> },
      { path: 'colaboradores', element: <ColaboradoresPage /> },
      { path: 'lanza-tu-carrera', element: <LanzaTuCarreraPage /> },
      ...Object.entries(localizedRoutes)
        .filter(([language]) => language !== 'cast')
        .map(([language, config]) => ({
          path: config.prefix,
          children: [
            ...createLocalizedChildren(language),
            { path: '*', element: <Navigate to={getLocalizedPath(language, 'home')} replace /> },
          ],
        })),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default router;
