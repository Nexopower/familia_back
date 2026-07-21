import {
  construirConteo,
  calcularTotales,
  calcularCierre,
  sugerirRetiro,
} from './caja.calc';

describe('caja.calc', () => {
  describe('construirConteo + calcularTotales', () => {
    it('separa billetes y monedas y suma totales', () => {
      const lineas = construirConteo({ 2000: 1, 500: 1, 25: 4, 1: 10 });
      const t = calcularTotales(lineas);
      expect(t.totalBilletes).toBe(2500); // 2000 + 500
      expect(t.totalMonedas).toBe(110); // 25*4 + 1*10
      expect(t.totalGeneral).toBe(2610);
    });

    it('ignora cantidades negativas o no enteras', () => {
      const lineas = construirConteo({ 100: -3, 50: 2.9 });
      const t = calcularTotales(lineas);
      expect(t.totalBilletes).toBe(100); // 100→0, 50*2
      expect(t.totalGeneral).toBe(100);
    });
  });

  describe('calcularCierre', () => {
    it('deja todas las monedas + fondo de billetes y retira el resto', () => {
      // 4000 en billetes, 300 en monedas
      const lineas = construirConteo({ 2000: 2, 25: 12 });
      const r = calcularCierre({
        lineas,
        fondoBilletes: 500,
        monedasModo: 'todas',
      });
      expect(r.totalContado).toBe(4300);
      expect(r.monedasDejar).toBe(300);
      expect(r.billetesDejar).toBe(500);
      expect(r.montoRetirar).toBe(3500);
      expect(r.fondoResultante).toBe(800);
    });

    it('respeta el monto fijo de monedas a dejar', () => {
      const lineas = construirConteo({ 1000: 1, 25: 8 }); // 1000 billetes, 200 monedas
      const r = calcularCierre({
        lineas,
        fondoBilletes: 500,
        monedasModo: 'fijo',
        monedasFijo: 100,
      });
      expect(r.monedasDejar).toBe(100);
      expect(r.montoRetirar).toBe(600); // 1200 - 100 - 500
    });

    it('no retira monto negativo cuando hay poco efectivo', () => {
      const lineas = construirConteo({ 100: 2 }); // 200 billetes
      const r = calcularCierre({
        lineas,
        fondoBilletes: 500,
        monedasModo: 'todas',
      });
      expect(r.billetesDejar).toBe(200); // no puede dejar más de lo que hay
      expect(r.montoRetirar).toBe(0);
    });
  });

  describe('sugerirRetiro', () => {
    it('sugiere billetes mayor a menor (greedy) sin límite de existencias', () => {
      const r = sugerirRetiro(3700);
      expect(r.lineas).toEqual([
        { valor: 2000, cantidad: 1, subtotal: 2000 },
        { valor: 1000, cantidad: 1, subtotal: 1000 },
        { valor: 500, cantidad: 1, subtotal: 500 },
        { valor: 200, cantidad: 1, subtotal: 200 },
      ]);
      expect(r.cubierto).toBe(3700);
      expect(r.restante).toBe(0);
    });

    it('limita por los billetes realmente disponibles y reporta restante', () => {
      const disponibles = construirConteo({ 2000: 0, 1000: 0, 500: 3, 100: 2 });
      const r = sugerirRetiro(3700, disponibles);
      // solo hay 3x500=1500 y 2x100=200 → cubre 1700, restan 2000
      expect(r.cubierto).toBe(1700);
      expect(r.restante).toBe(2000);
    });

    it('monto 0 no sugiere nada', () => {
      const r = sugerirRetiro(0);
      expect(r.lineas).toHaveLength(0);
      expect(r.restante).toBe(0);
    });
  });
});
