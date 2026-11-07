import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolicitudEmpleadorModal } from './solicitud-empleador-modal';

describe('SolicitudEmpleadorModal', () => {
  let fixture: ComponentFixture<SolicitudEmpleadorModal>;
  let descriptorShowModal: PropertyDescriptor | undefined;

  beforeEach(async () => {
    descriptorShowModal = Object.getOwnPropertyDescriptor(
      HTMLDialogElement.prototype,
      'showModal',
    );
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });

    await TestBed.configureTestingModule({ imports: [SolicitudEmpleadorModal] }).compileComponents();

    fixture = TestBed.createComponent(SolicitudEmpleadorModal);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.classList.remove('modal-abierto');

    if (descriptorShowModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', descriptorShowModal);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    }
  });

  function escribir(valor: string): void {
    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = valor;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function enviar(): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('muestra el título, exige 20 caracteres sin espacios y envía el comentario limpio', () => {
    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Solicitud para convertirse en empleador');
    expect(host.querySelector('#solicitud-motivo')?.hasAttribute('required')).toBe(false);

    escribir(`   ${'a'.repeat(19)}   `);
    enviar();

    expect(confirmar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('al menos 20 caracteres');

    escribir(`   ${'a'.repeat(20)}   `);
    enviar();

    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith('a'.repeat(20));
  });

  it('bloquea el cierre y muestra el estado de envío mientras se procesa', () => {
    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    fixture.componentRef.setInput('enviando', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const submit = host.querySelector('button[type="submit"]') as HTMLButtonElement;
    const cancelar = host.querySelector('.solicitud-modal__cancelar') as HTMLButtonElement;
    const textarea = host.querySelector('textarea') as HTMLTextAreaElement;

    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Enviando');
    expect(cancelar.disabled).toBe(true);
    expect(textarea.readOnly).toBe(true);

    cancelar.click();
    fixture.detectChanges();

    expect(cerrar).not.toHaveBeenCalled();
  });

  it('muestra el error inline y lo limpia al corregir el comentario', () => {
    const limpiarError = vi.fn();
    fixture.componentInstance.limpiarError.subscribe(limpiarError);

    fixture.componentRef.setInput('error', 'Ya tenés una solicitud pendiente.');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya tenés una solicitud pendiente.',
    );

    escribir('Un comentario suficientemente largo para corregir el error.');

    expect(limpiarError).toHaveBeenCalledTimes(1);
  });
});
