import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FornecedoresContextProps {
  // Adicione estados globais do módulo aqui
}

const FornecedoresContext = createContext<FornecedoresContextProps>({} as FornecedoresContextProps);

export const FornecedoresProvider = ({ children }: { children: ReactNode }) => {
  // Estados globais do módulo
  return (
    <FornecedoresContext.Provider value={{}}>
      {children}
    </FornecedoresContext.Provider>
  );
};

export const useFornecedores = () => useContext(FornecedoresContext);
