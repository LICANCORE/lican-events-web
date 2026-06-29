import { RouterProvider } from 'react-router-dom';

import LanguageProvider from './i18n/LanguageProvider';
import router from './router';

function App() {
  return (
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  );
}

export default App;
