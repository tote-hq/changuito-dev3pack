# UI — Pedido de plata

Superseded by [TDD.md](./TDD.md), [tdd-pay.md](./tdd-pay.md), and [tdd-shopper.md](./tdd-shopper.md). The mock below is the old Mercado Pago draft. Do not build it.

Borrador para aprobar. Mock estático: [mocks.html](./mocks.html).

Sigue `apps/branding` y las reglas de modal que ya tiene la app (`Modal.tsx`: una X, Escape, foco que vuelve al botón que abrió).

Copy de producto en rioplatense. El botón que ya existe no se renombra.

| | ES | EN |
|---|---|---|
| Pago que ya existe | Proceder al pago | Proceed to checkout |
| Botón nuevo | Pedir este pago | Request this payment |
| Título del modal | Pedido de plata | Funding request |
| Email | Email | Email |
| Enviar | Enviar link | Send link |
| Ayuda del QR | Quien paga escanea este código o abre el link. | The payer scans this code or opens the link. |
| Link de teclado | Abrir Mercado Pago | Open Mercado Pago |
| Éxito | Listo. El pago entró. | Done. The payment arrived. |
| Cierre de éxito | Listo | Done |
| Saldo de A | Tu saldo: {n} USDC | Your balance: {n} USDC |
| Esperando | Esperando el pago… | Waiting for the payment… |
| Falló la acreditación | El pago entró y no pudimos cargar el saldo. | The payment arrived and we could not add the balance. |

No aparecen en pantalla: devnet, wallet, blockchain, on-chain, smart contract.

## Dónde entra el botón

En la fila `.cart-actions` de la tarjeta del carrito, a la derecha de **Proceder al pago**, y en la misma fila del riel (`data-testid="rail-pay"`). Mismo handler.

- Primario, sunflower, sin cambio: `data-testid="cart-pay"` / `rail-pay`. Texto «Proceder al pago».
- Secundario, `btn-ghost`, 44px: `data-testid="funding-request"`. Texto «Pedir este pago».
- Se muestra cuando el carrito se puede pagar y hay sesión Pollar. Si no hay dirección Solana, el botón queda deshabilitado y el texto de ayuda es «Entrá para pedir este pago.»

El saldo, cuando hay un pedido de esta sesión, es una línea encima de los botones: `data-testid="funding-balance"`. Arranca oculta. Pasa a «Esperando el pago…» y después a «Tu saldo: {n} USDC».

## Modal de A

`data-testid="funding-modal"`. Centrado. Ancho máximo 420px. Fondo off-white, texto espresso, borde espresso al 12%.

1. Header: título «Pedido de plata» + X (`aria-label="Cerrar"`). Sin otro Cerrar.
2. Monto en ARS, el del carrito, en Inter Bold. Una línea: «Se acreditan {n} USDC en tu saldo.»
3. Campo email. `<label for="funding-email">Email</label>`. `type="email"`, `autocomplete="email"`, `inputmode="email"`. No es obligatorio para mostrar el QR: si está vacío, no se abre el mail y el QR igual sirve.
4. Botón primario «Enviar link». Al confirmar: guarda, muestra el QR, copia el link al cuerpo de un `mailto:`.
5. QR 240×240, `role="img"`, `alt="Código de Mercado Pago por {monto}."` Debajo, el rótulo «Prueba de Mercado Pago» y un link real al `initPoint`: «Abrir Mercado Pago». Quien no puede escanear paga por ahí.
6. Línea de estado `aria-live="polite"`: «Esperando el pago…»

Backdrop y Escape cierran. Cerrar no cancela el pedido.

## Página de B

Ruta `/pedir/[id]`. Misma caja, centrada en una página off-white vacía. No hay carrito.

- `pending`: título, monto, QR, link «Abrir Mercado Pago», «Esperando el pago…»
- `credited`: se va el QR. Título igual. Texto «Listo. El pago entró.» Botón primario **Listo** (`data-testid="funding-done"`) cierra la ventana si `window.close` puede, si no deja la frase y la X.
- `failed`: «El pago entró y no pudimos cargar el saldo.» Sin botón de reintento en este corte.
- id desconocido: «Ese pedido no está.» y la X.

B no ve el email de A ni la dirección.

## Estados de A después del pago

La línea `funding-balance` pasa a «Tu saldo: {n} USDC». **Proceder al pago** sigue habilitado y abre el checkout que ya existe. El modal de A, si sigue abierto, muestra el mismo éxito que B, sin pedir otro mail.

## UX

- Una acción primaria por vista. En el carrito sigue siendo pagar. Pedir es ghost.
- El QR no es la única salida. El link es la alternativa de teclado.
- Nada de mascota nueva. No se usa la pose descartada de `apps/branding/_discarded/`.
- Mobile 390: la fila de botones pasa a columna, los dos a 100% de ancho, pagar arriba. El modal ocupa el ancho menos 24px de margen. El QR baja a 200px si no entra.
- Desktop 1440: modal centrado, carrito como hoy.

## ADA (WCAG 2.2 AA, el modal y la fila de botones)

Medir en 390 y 1440, alcance solo este modal y la fila `.cart-actions` / riel. No la página entera.

| Criterio | Qué tiene que cumplirse |
|---|---|
| 1.4.3 Contraste | Espresso `#2A1A14` sobre off-white `#FAFAF7` y sobre sunflower `#F4B942`. Nada de texto sunflower chico sobre off-white. Nada de blanco sobre arcilla |
| 2.1.1 Teclado | Email, Enviar, link de Mercado Pago, X y Listo se alcanzan sin mouse. El QR no es el único camino |
| 2.4.7 Foco visible | Anillo espresso de 2px en lo que tiene foco |
| 2.5.5 / 2.5.8 Target | X, botones y link: mínimo 44×44 |
| 4.1.2 Nombre, rol, valor | `role="dialog"`, `aria-modal`, título etiquetado, X con nombre «Cerrar», email con label, QR con `alt` |
| 4.1.3 Estado | El «Esperando» y el éxito van en `aria-live="polite"` |

Critical o serious en ese alcance frenan el OK. Moderate y minor se anotan y no frenan.

## Mock

Abrí `docs/funding-request/mocks.html` en el navegador. Son cuatro cuadros: carrito, modal de A, éxito de B, saldo de A. El QR dibujado no cobra.
