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

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'eventos', element: <EventosPage /> },
      { path: 'servicios', element: <ServiciosPage /> },
      { path: 'nuestras-fiestas', element: <NuestrasFiestasPage /> },
      { path: 'nuestras-fiestas/feral', element: <FeralPage /> },
      { path: 'nuestras-fiestas/headbang-dealers', element: <HeadbangDealersPage /> },
      { path: 'nuestras-fiestas/night-of-series', element: <NightOfSeriesPage /> },
      { path: 'colaboradores', element: <ColaboradoresPage /> },
      { path: 'lanza-tu-carrera', element: <LanzaTuCarreraPage /> },
      { path: 'artistas', element: <LanzaTuCarreraPage /> },
      { path: 'galeria', element: <GaleriaPage /> },
      { path: 'contacto', element: <ContactoPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
});

export default router;
