/* FINAL ESTIMATED TOMORROW: exact 58-town allow-list */
(function(){
  const BADOC_PINILI_58 = ['Turod','Labut','Caraitan','Paltit','Lubigan','Bato','Ar-Arusip','Alay-Nangbabaan (Alay 15-B)','Nagrebcan','Balbaldez','Saud','Pagsanahan Norte','Pagsanahan Sur','La Virgen Milagrosa (Paguetpet)','Morong','Santa Cruz Norte','Santa Cruz Sur','Alogoog','Lacuben','Aring','Canaan (Pob.)','Garreta (Pob.)','Gabut Norte','Gabut Sur','Napu','Mabusag Norte','Mabusag Sur','Parang','Pasuc','Uguis','Camanga','Madupayas','Liliputen','Lumbaan-Bicbica','Sacritan','Aglipay','Santo Tomas','Cabaroan','Buanga','Puritac','Dalayap','Nagtrigoan','Upon','Valbuena (Pob.)','Pagdilao (Pob.)','Salanap','Barbar','Bungro','Pugaoan','Apatut-Lubong','Darat','Capangdanan','Gulpeng','Badio','Bulbulala','Puzol','Tartarabang','Maglaoi Sur'];
  function etNorm(v){
    return String(v ?? "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[\u2010-\u2015]/g,"-")
      .replace(/[_-]+/g," ")
      .replace(/[()]/g," ")
      .replace(/\s+/g," ")
      .trim().toUpperCase();
  }
  const ET_TOWN_SET = new Set(BADOC_PINILI_58.map(etNorm));
  window.BADOC_PINILI_58_TOWN_ALLOWED = function(v){
    return ET_TOWN_SET.has(etNorm(v));
  };
  window.BADOC_PINILI_57_TOWN_ALLOWED = window.BADOC_PINILI_58_TOWN_ALLOWED;
})();
