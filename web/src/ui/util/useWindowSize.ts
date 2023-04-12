import {useEffect, useState} from "react";

export default function useWindowSize() {
  const [windowSize, setWindowSize] = useState({width: document.documentElement.clientWidth, height: document.documentElement.clientHeight})

  useEffect(() => {
    const cb = () => {
      setWindowSize({width: document.documentElement.clientWidth, height: document.documentElement.clientHeight})
    }
    window.addEventListener('resize', cb)

    return () => {
      window.removeEventListener('resize', cb);
    }
  }, []);

  return windowSize;
}