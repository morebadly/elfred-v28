type Receipt={phase?:string;provider?:string;output?:unknown};
export function finalReceipts<T extends Receipt>(receipts:T[]):T[]{
 const final=[...receipts].reverse().find(r=>['work','repair'].includes(r.phase||'')&&r.provider!=='conditional-skip');
 return final?[final]:receipts.filter(r=>!['review','context','collaboration'].includes(r.phase||''));
}
