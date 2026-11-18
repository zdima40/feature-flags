import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FlagsApiService } from '../../../core/api/flags-api.service';

@Component({
  imports: [DatePipe],
  selector: 'app-flags-list',
  styleUrl: './flags-list.css',
  templateUrl: './flags-list.html',
})
export class FlagsList {
  private readonly api = inject(FlagsApiService);

  protected readonly flags = rxResource({
    stream: () => this.api.list(),
  });
}
