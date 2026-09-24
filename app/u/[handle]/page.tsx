"use client";
import {use,useEffect,useState} from 'react';
import {DeviceFrame} from '../../device-frame';

export default function PublicProfile({params}:{params:Promise<{handle:string}>}) {
  const {handle}=use(params);
  const [profile,setProfile]=useState<{name:string;bio:string}|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;void fetch('/api/elfred/profiles/'+encodeURIComponent(handle)).then(async response=>{const body=await response.json() as {name:string;bio:string;error?:{message:string}};if(!response.ok)throw Error(body.error?.message||'主页不可访问');if(active)setProfile(body)}).catch(err=>{if(active)setError(err.message)});return()=>{active=false}},[handle]);
  return <DeviceFrame label="Elfred 公开主页" className="v277-device v279-device v280-device"><main className="v277-page v279-friend-profile-page"><section className="v279-friend-identity"><h1>{profile?.name||'公开主页'}</h1><p>@{handle}</p><p>{error||profile?.bio||'正在读取本人选择公开的资料…'}</p></section><p className="v278-utility-note">这里只展示对方明确公开的称呼与简介。</p><a className="v277-secondary" href="/v28">打开 Elfred</a></main></DeviceFrame>;
}
