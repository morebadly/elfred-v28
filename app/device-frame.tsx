"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export function DeviceFrame({children,label,className=""}:{children:ReactNode;label:string;className?:string}) {
  const [scale,setScale]=useState(1);
  const isIphone17=className.split(/\s+/).includes("v277-device");
  useEffect(()=>{
    const deviceWidth=isIphone17?422:393;
    const deviceHeight=isIphone17?894:852;
    const resize=()=>{
      const gutter=window.innerWidth<=600?12:32;
      setScale(Math.min(1,(window.innerHeight-gutter)/deviceHeight,(window.innerWidth-gutter)/deviceWidth));
    };
    resize();window.addEventListener("resize",resize);
    return()=>window.removeEventListener("resize",resize);
  },[isIphone17]);
  return <main className={`app-shell ${className}`} style={{"--device-scale":scale} as CSSProperties}><div className={`device-frame${isIphone17?" iphone17-frame":""}`}>
    {isIphone17&&<><span className="iphone17-side-buttons" aria-hidden="true"/><span className="iphone17-power-button" aria-hidden="true"/><span className="iphone17-island" aria-hidden="true"><i/></span></>}
    <section className="phone-stage" aria-label={label}>{children}</section>
  </div></main>;
}
