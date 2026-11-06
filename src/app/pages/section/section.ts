import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-section',
  imports: [RouterLink],
  templateUrl: './section.html',
  styleUrl: './section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Section {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { requireSync: true });

  protected readonly title = computed(
    () => (this.data()['title'] as string | undefined) ?? 'AppointMee',
  );
  protected readonly description = computed(
    () => (this.data()['description'] as string | undefined) ?? 'Contenido de la sección.',
  );
}
