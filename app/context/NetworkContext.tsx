"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type NetworkType = "testnet" | "mainnet";

interface NetworkContextValue {
  network: NetworkType;
  currency: string;
  setNetwork: (net: NetworkType) => void;
  toggleNetwork: () => void;
  isMainnet: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: "testnet",
  currency: "TAZ",
  setNetwork: () => {},
  toggleNetwork: () => {},
  isMainnet: false,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<NetworkType>("testnet");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nocturne_network") as NetworkType;
      if (saved === "mainnet" || saved === "testnet") {
        setNetworkState(saved);
      }
    }
  }, []);

  const setNetwork = (net: NetworkType) => {
    setNetworkState(net);
    if (typeof window !== "undefined") {
      localStorage.setItem("nocturne_network", net);
    }
  };

  const toggleNetwork = () => {
    setNetwork(network === "testnet" ? "mainnet" : "testnet");
  };

  const currency = network === "testnet" ? "TAZ" : "ZEC";

  return (
    <NetworkContext.Provider
      value={{
        network,
        currency,
        setNetwork,
        toggleNetwork,
        isMainnet: network === "mainnet",
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
