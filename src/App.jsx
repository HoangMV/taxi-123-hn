import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from './layouts/MainLayout';
import { appRoutes } from './routes';

function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        newestOnTop
        closeOnClick
        toastClassName="mx-3 mt-3 rounded-2xl text-sm shadow-lg"
      />
      <MainLayout>
        <Routes>
          {appRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element}>
              {(route.children || []).map((child) => (
                <Route
                  key={`${route.path}/${child.path ?? 'index'}`}
                  index={child.index}
                  path={child.path}
                  element={child.element}
                />
              ))}
            </Route>
          ))}
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
