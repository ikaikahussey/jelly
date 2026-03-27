import React, { createContext, useContext, useEffect, useState } from 'react';

export type Skin = 'hypercard' | 'helvetica';

interface SkinContextType {
  skin: Skin;
  setSkin: (skin: Skin) => void;
}

const SkinContext = createContext<SkinContextType>({
  skin: 'hypercard',
  setSkin: () => {},
});

export const useSkin = () => {
  const context = useContext(SkinContext);
  if (!context) {
    throw new Error('useSkin must be used within a SkinProvider');
  }
  return context;
};

interface SkinProviderProps {
  children: React.ReactNode;
}

export function SkinProvider({ children }: SkinProviderProps) {
  const [skin, setSkin] = useState<Skin>(() => {
    const saved = localStorage.getItem('jelly-skin') as Skin;
    return saved === 'helvetica' ? 'helvetica' : 'hypercard';
  });

  const applySkin = (newSkin: Skin) => {
    const root = document.documentElement;
    root.classList.remove('skin-hypercard', 'skin-helvetica');
    root.classList.add(`skin-${newSkin}`);
  };

  useEffect(() => {
    applySkin(skin);
  }, [skin]);

  const handleSetSkin = (newSkin: Skin) => {
    setSkin(newSkin);
    localStorage.setItem('jelly-skin', newSkin);
    applySkin(newSkin);
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin: handleSetSkin }}>
      {children}
    </SkinContext.Provider>
  );
}
