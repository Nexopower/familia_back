import { FacturasService } from './facturas.service';

/**
 * Paso 7(b): una venta con múltiples productos debe generar UNA sola llamada
 * SQL con el arreglo completo de líneas (sp_factura_detalle_agregar_batch con
 * OPENJSON), no una ejecución por producto.
 */
describe('FacturasService.crearCompleta (batch de líneas)', () => {
  function build() {
    const sqlMock = {
      executeQueryParams: jest.fn().mockResolvedValue([{ codfac: 7 }]),
    } as any;
    const fiaosMock = { crear: jest.fn() } as any;
    const fondosMock = { consumir: jest.fn() } as any;
    const service = new FacturasService(sqlMock, fiaosMock, fondosMock);
    jest
      .spyOn(service, 'obtener')
      .mockResolvedValue({ factura: { codfac: 7 } } as any);
    return { service, sqlMock };
  }

  const items = [
    { codprd: 1, cantidad: 2, preuni: 10 },
    { codprd: 2, cantidad: 1, preuni: 5.5 },
    { codprd: 3, cantidad: 4, preuni: null },
  ];

  it('envía TODAS las líneas en una sola petición a SQL', async () => {
    const { service, sqlMock } = build();

    await service.crearCompleta({
      codneg: 1,
      tipo: 'venta',
      items,
      cerrar: true,
      codusr: 'AAA00001',
      usercrea: 1,
    } as any);

    // Una sola ida a la base de datos para crear + detallar + cerrar.
    expect(sqlMock.executeQueryParams).toHaveBeenCalledTimes(1);
  });

  it('usa el SP batch (OPENJSON) una única vez, sin EXEC por línea', async () => {
    const { service, sqlMock } = build();

    await service.crearCompleta({
      codneg: 1,
      tipo: 'venta',
      items,
      cerrar: false,
      codusr: 'AAA00001',
      usercrea: 1,
    } as any);

    const [query, params] = sqlMock.executeQueryParams.mock.calls[0];

    expect(query).toContain('sp_factura_detalle_agregar_batch');
    // Exactamente UNA aparición del SP de detalle (nada fila por fila).
    const ejecuciones = (query.match(/sp_factura_detalle_agregar/g) ?? []).length;
    expect(ejecuciones).toBe(1);

    // El JSON lleva el arreglo completo de líneas.
    const lineas = JSON.parse(params.lineas_json);
    expect(lineas).toHaveLength(items.length);
    expect(lineas[0]).toMatchObject({ codprd: 1, cantidad: 2, preuni: 10 });
    expect(lineas[2]).toMatchObject({ codprd: 3, preuni: null });
  });
});
