import { createContext, useContext } from 'react';

export const RouterContext = createContext(null);
export const useRouter = () => useContext(RouterContext);
