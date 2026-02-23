export const formatPrice = (n:number)=> new Intl.NumberFormat('fr-FR', {style:'currency', currency:'XAF'}).format(n);
