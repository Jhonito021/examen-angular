import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ApiResourceService } from '../../core/services/api-resource.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientService } from '../../core/services/client.service';
import { OrderLineService } from '../../core/services/order-line.service';
import { ProductService } from '../../core/services/product.service';
import { ProductionStepService } from '../../core/services/production-step.service';
import { QualityControlService } from '../../core/services/quality-control.service';
import { TextileOrderService } from '../../core/services/textile-order.service';
import { OperationsService } from '../../core/services/operations.service';
import { API_ENDPOINTS } from '../../core/config/api-endpoints';
import { AnalyticsResponse, SettingResponse } from '../../core/models/common.models';
import { EmptyState } from '../../shared/components/empty-state';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';

type PageKey =
  | 'dashboard'
  | 'clients'
  | 'products'
  | 'orders'
  | 'order-lines'
  | 'production-steps'
  | 'quality-controls'
  | 'statistics'
  | 'settings';
type Row = Record<string, unknown>;
interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  min?: number;
  step?: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const asRows = <T>(value: T[]): Row[] => value as unknown as Row[];

@Component({
  selector: 'app-business-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    StatCard,
    EmptyState,
  ],
  template: `
    <section class="mx-auto max-w-7xl">
      @if (page() === 'dashboard') {
        <app-page-header
          eyebrow="Atelier textile"
          title="Tableau de bord"
          description="Vue d’ensemble de l’activité de l’atelier"
          icon="fa-solid fa-chart-pie"
        >
          <a class="secondary-button" routerLink="/orders"
            ><i class="fa-solid fa-arrow-right"></i>Voir les commandes</a
          >
        </app-page-header>
        @if (dashboardMetrics().length) {
          <div class="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            @for (metric of dashboardMetrics(); track metric[0]) {
              <app-stat-card
                [label]="metric[0]"
                [value]="metric[1]"
                icon="fa-solid fa-chart-simple"
              />
            }
          </div>
        } @else if (loading()) {
          <p class="mt-8 text-sm text-slate-500">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i>Chargement des indicateurs…
          </p>
        }
        <div class="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="flex items-center gap-2 text-lg font-extrabold">
                <i class="fa-solid fa-clock text-amber-500"></i>Commandes en retard
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                Livraison prévue dépassée, hors commandes livrées.
              </p>
            </div>
            <a class="text-sm font-bold text-blue-700" routerLink="/orders"
              ><i class="fa-solid fa-arrow-right mr-1"></i>Toutes les commandes</a
            >
          </div>
          @if (delayed().length) {
            <div class="mt-5 divide-y divide-slate-100">
              @for (order of delayed(); track order['id']) {
                <div class="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span class="font-bold"
                    ><i class="fa-solid fa-file-invoice mr-2 text-slate-400"></i
                    >{{ order['number'] }}</span
                  ><span class="text-sm text-slate-500"
                    ><i class="fa-solid fa-calendar-days mr-1"></i
                    >{{ stringValue(order['deliveryDate']) | date: 'mediumDate' }}</span
                  ><span class="status-pill status-danger">{{ order['status'] }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="mt-5 text-sm text-slate-500">
              {{ loading() ? 'Chargement…' : 'Aucune commande en retard.' }}
            </p>
          }
        </div>
      } @else if (page() === 'statistics') {
        <div>
          <app-page-header
            eyebrow="Pilotage"
            title="Statistiques"
            description="Indicateurs de production et délais des commandes"
            icon="fa-solid fa-chart-line"
          />
        </div>
        <form
          class="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          [formGroup]="dateForm"
          (ngSubmit)="loadStatistics()"
        >
          <label class="field-label"
            >Du<input class="form-input mt-1" type="date" formControlName="from"
          /></label>
          <label class="field-label"
            >Au<input class="form-input mt-1" type="date" formControlName="to"
          /></label>
          <button class="primary-button" [disabled]="loading()">
            <i class="fa-solid fa-arrows-rotate"></i>Actualiser
          </button>
        </form>
        <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          @for (metric of dashboardMetrics(); track metric[0]) {
            <app-stat-card
              [label]="metric[0]"
              [value]="metric[1]"
              icon="fa-solid fa-chart-column"
            />
          }
        </div>
        <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-6 py-4">
            <h2 class="flex items-center gap-2 font-extrabold">
              <i class="fa-solid fa-hourglass-half text-blue-600"></i>Délais par commande
            </h2>
          </div>
          @if (groups().length) {
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Durée prévue</th>
                    <th>Durée réelle</th>
                    <th>Retard</th>
                    <th>Risque</th>
                  </tr>
                </thead>
                <tbody>
                  @for (group of groups(); track group[0]) {
                    <tr>
                      <td class="font-bold">{{ group[0] }}</td>
                      <td>{{ group[1]['Durée prévue (h)'] }} h</td>
                      <td>{{ group[1]['Durée réelle (h)'] }} h</td>
                      <td>{{ group[1]['Retard (jours)'] }} j</td>
                      <td>{{ group[1]['Risque de retard'] ? 'Oui' : 'Non' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="p-6 text-sm text-slate-500">
              {{ loading() ? 'Chargement…' : 'Aucune donnée pour cette période.' }}
            </p>
          }
        </div>
      } @else if (page() === 'settings') {
        <div>
          <app-page-header
            eyebrow="Administration"
            title="Paramètres de production"
            description="Durées de référence utilisées pour planifier les étapes de l’atelier"
            icon="fa-solid fa-sliders"
          />
        </div>
        <div
          class="mt-7 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          @for (setting of settings(); track setting.name) {
            <div class="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p class="font-bold">
                  <i class="fa-solid fa-clock mr-2 text-slate-400"></i>{{ setting.label }}
                </p>
                <p class="mt-1 text-xs text-slate-500">{{ setting.name }}</p>
              </div>
              <div class="flex items-center gap-3">
                <input
                  #value
                  class="form-input w-28"
                  type="number"
                  min="1"
                  [value]="setting.value"
                /><span class="text-sm text-slate-500">jours</span
                ><button class="secondary-button" (click)="saveSetting(setting, value.value)">
                  <i class="fa-solid fa-floppy-disk"></i>Enregistrer
                </button>
              </div>
            </div>
          } @empty {
            <p class="p-6 text-sm text-slate-500">
              {{ loading() ? 'Chargement…' : 'Aucun paramètre disponible.' }}
            </p>
          }
        </div>
      } @else {
        <app-page-header
          eyebrow="Gestion de l’atelier"
          [title]="title()"
          [description]="total() + ' élément(s) au total'"
          icon="fa-solid fa-table-cells-large"
        >
          @if (canCreate()) {
            <button class="primary-button" (click)="startCreate()">
              <i class="fa-solid fa-plus"></i>Ajouter
            </button>
          }
        </app-page-header>
        <form class="mt-6 flex flex-wrap gap-3" (ngSubmit)="search()">
          <span class="relative max-w-md flex-1"
            ><i
              class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
            ></i
            ><input
              class="form-input pl-11"
              [(ngModel)]="query"
              name="query"
              placeholder="Rechercher…"
              aria-label="Rechercher"
          /></span>
          @if (page() === 'orders' || page() === 'production-steps') {
            <select class="form-input w-52" [(ngModel)]="statusFilter" name="status">
              <option value="">Tous les statuts</option>
              @for (status of statusOptions(); track status) {
                <option [value]="status">{{ status }}</option>
              }
            </select>
          }
          <button class="secondary-button">
            <i class="fa-solid fa-magnifying-glass"></i>Rechercher
          </button>
          @if (query || statusFilter) {
            <button
              type="button"
              class="text-sm font-bold text-slate-500"
              (click)="query = ''; statusFilter = ''; search()"
            >
              <i class="fa-solid fa-xmark mr-1"></i>Effacer
            </button>
          }
        </form>
        @if (editorOpen()) {
          <div
            class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm"
            (click)="closeEditor()"
          >
            <section
              class="my-auto w-full max-w-2xl rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"
              (click)="$event.stopPropagation()"
            >
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="flex items-center gap-2 text-xl font-extrabold">
                    <i class="fa-solid fa-pen-to-square text-blue-700"></i
                    >{{ editingId() ? 'Modifier' : 'Nouvel élément' }} · {{ title() }}
                  </h2>
                  <p class="mt-1 text-sm text-slate-500">
                    Les champs marqués d’un astérisque sont obligatoires.
                  </p>
                </div>
                <button
                  class="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                  aria-label="Fermer"
                  (click)="closeEditor()"
                >
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <form
                class="mt-6 grid gap-4 sm:grid-cols-2"
                [formGroup]="editorForm"
                (ngSubmit)="save()"
              >
                @for (field of fields(); track field.key) {
                  <label class="field-label sm:col-span-2"
                    >{{ field.label }}
                    @if (field.required) {
                      <span class="text-red-500">*</span>
                    }
                    @if (field.options) {
                      <select class="form-input mt-1" [formControlName]="field.key">
                        <option value="">Sélectionner…</option>
                        @for (option of field.options; track option.value) {
                          <option [value]="option.value">{{ option.label }}</option>
                        }
                      </select>
                    } @else if (field.type === 'textarea') {
                      <textarea
                        class="form-input mt-1 min-h-24"
                        [formControlName]="field.key"
                        rows="3"
                      ></textarea>
                    } @else {
                      <input
                        class="form-input mt-1"
                        [type]="field.type || 'text'"
                        [min]="field.min ?? null"
                        [step]="field.step ?? null"
                        [formControlName]="field.key"
                      />
                    }
                  </label>
                }
                <div class="flex justify-end gap-3 pt-2 sm:col-span-2">
                  <button type="button" class="secondary-button" (click)="closeEditor()">
                    <i class="fa-solid fa-xmark"></i>Annuler</button
                  ><button class="primary-button" [disabled]="editorForm.invalid || saving()">
                    <i class="fa-solid fa-floppy-disk"></i
                    >{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
                  </button>
                </div>
              </form>
            </section>
          </div>
        }
        @if (actionOrder()) {
          <div
            class="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
            (click)="actionOrder.set(null)"
          >
            <section
              class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              (click)="$event.stopPropagation()"
            >
              <h2 class="flex items-center gap-2 text-xl font-extrabold">
                <i class="fa-solid fa-wrench text-blue-700"></i>{{ actionTitle() }}
              </h2>
              <p class="mt-1 text-sm text-slate-500">
                <i class="fa-solid fa-file-invoice mr-1"></i>Commande
                {{ actionOrder()?.['number'] }}
              </p>
              <form class="mt-5 space-y-4" [formGroup]="actionForm" (ngSubmit)="runAction()">
                @if (
                  actionType() === 'COUPE' ||
                  actionType() === 'COUTURE' ||
                  actionType() === 'FINITION'
                ) {
                  <label class="field-label"
                    >Quantité produite *<input
                      class="form-input mt-1"
                      type="number"
                      min="1"
                      formControlName="quantity"
                  /></label>
                }
                @if (actionType() === 'quality-control') {
                  <label class="field-label"
                    >Résultat *<select class="form-input mt-1" formControlName="status">
                      <option value="CONFORME">Conforme</option>
                      <option value="NON_CONFORME">Non conforme</option>
                    </select></label
                  >
                }
                @if (actionType() !== 'production/start' && actionType() !== 'delivery') {
                  <label class="field-label"
                    >Responsable *<input class="form-input mt-1" formControlName="responsible"
                  /></label>
                }
                @if (actionType() === 'delivery') {
                  <label class="field-label"
                    >Destinataire<input class="form-input mt-1" formControlName="recipient"
                  /></label>
                }
                @if (actionType() !== 'production/start' && actionType() !== 'delivery') {
                  <label class="field-label"
                    >Commentaire<textarea
                      class="form-input mt-1"
                      rows="3"
                      formControlName="comment"
                    ></textarea>
                  </label>
                }
                <div class="flex justify-end gap-3">
                  <button type="button" class="secondary-button" (click)="actionOrder.set(null)">
                    <i class="fa-solid fa-xmark"></i>Annuler</button
                  ><button class="primary-button" [disabled]="actionForm.invalid || saving()">
                    <i class="fa-solid fa-check"></i>{{ saving() ? 'Traitement…' : 'Confirmer' }}
                  </button>
                </div>
              </form>
            </section>
          </div>
        }
        <div class="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          @if (loading()) {
            <div class="px-6 py-10 text-center text-sm text-slate-500">
              <i class="fa-solid fa-spinner fa-spin mr-2"></i>Chargement des données…
            </div>
          } @else if (!rows().length) {
            <app-empty-state
              title="Aucun résultat"
              description="Aucune donnée ne correspond à cette recherche."
              icon="fa-solid fa-inbox"
            />
          } @else {
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead>
                  <tr>
                    @for (column of columns(); track column.key) {
                      <th>{{ column.label }}</th>
                    }
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row['id']) {
                    <tr>
                      @for (column of columns(); track column.key) {
                        <td [class.font-bold]="column.key === 'number' || column.key === 'name'">
                          {{ cell(row, column.key) }}
                        </td>
                      }
                      <td>
                        <div class="flex flex-wrap justify-end gap-2">
                          @if (page() === 'orders' && canCreate()) {
                            @if (row['status'] === 'COMMANDE') {
                              <button
                                class="small-action"
                                (click)="beginAction(row, 'production/start')"
                              >
                                <i class="fa-solid fa-play"></i>Démarrer
                              </button>
                            }
                            @if (
                              row['status'] === 'COUPE' ||
                              row['status'] === 'COUTURE' ||
                              row['status'] === 'FINITION'
                            ) {
                              <button
                                class="small-action"
                                (click)="beginAction(row, stringValue(row['status']))"
                              >
                                <i class="fa-solid fa-check"></i>Terminer {{ row['status'] }}
                              </button>
                            }
                            @if (row['status'] === 'CONTROLE_QUALITE') {
                              <button
                                class="small-action"
                                (click)="beginAction(row, 'quality-control')"
                              >
                                <i class="fa-solid fa-magnifying-glass"></i>Contrôler</button
                              ><button class="small-action" (click)="beginAction(row, 'delivery')">
                                <i class="fa-solid fa-truck"></i>Livrer
                              </button>
                            }
                          }
                          @if (canManage()) {
                            <button class="small-action" (click)="startEdit(row)" title="Modifier">
                              <i class="fa-solid fa-pen"></i
                              ><span class="hidden xl:inline">Modifier</span></button
                            ><button
                              class="small-action text-red-600"
                              (click)="remove(row)"
                              title="Supprimer"
                            >
                              <i class="fa-solid fa-trash"></i
                              ><span class="hidden xl:inline">Supprimer</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <div
            class="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500"
          >
            <span>Page {{ pageIndex() + 1 }} / {{ pageCount() }}</span>
            <div class="flex gap-2">
              <button
                class="secondary-button py-1.5"
                [disabled]="pageIndex() === 0 || loading()"
                (click)="changePage(-1)"
              >
                <i class="fa-solid fa-chevron-left"></i
                ><span class="hidden sm:inline">Précédent</span></button
              ><button
                class="secondary-button py-1.5"
                [disabled]="pageIndex() + 1 >= pageCount() || loading()"
                (click)="changePage(1)"
              >
                <span class="hidden sm:inline">Suivant</span
                ><i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class BusinessPageComponent implements OnInit, OnDestroy {
  readonly page = signal<PageKey>('dashboard');
  readonly title = signal('Tableau de bord');
  readonly rows = signal<Row[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageCount = signal(1);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly fields = signal<Field[]>([]);
  readonly dashboardMetrics = signal<[string, number][]>([]);
  readonly groups = signal<[string, Record<string, number>][]>([]);
  readonly delayed = signal<Row[]>([]);
  readonly settings = signal<SettingResponse[]>([]);
  readonly statusOptions = signal<string[]>([]);
  readonly actionOrder = signal<Row | null>(null);
  readonly actionType = signal('');
  query = '';
  statusFilter = '';
  readonly editorForm = new UntypedFormGroup({});
  readonly actionForm = new FormGroup({
    quantity: new FormControl<number | null>(null, Validators.min(1)),
    status: new FormControl('CONFORME', { nonNullable: true }),
    responsible: new FormControl('', { nonNullable: true }),
    comment: new FormControl('', { nonNullable: true }),
    recipient: new FormControl('', { nonNullable: true }),
  });
  readonly dateForm = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl(today(), { nonNullable: true }),
  });
  private routeSubscription?: Subscription;
  private readonly pageSize = 20;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly clients: ClientService,
    private readonly products: ProductService,
    private readonly orders: TextileOrderService,
    private readonly lines: OrderLineService,
    private readonly steps: ProductionStepService,
    private readonly quality: QualityControlService,
    private readonly operations: OperationsService,
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.data.subscribe((data) => {
      this.page.set((data['page'] as PageKey) ?? 'dashboard');
      this.title.set(typeof data['title'] === 'string' ? data['title'] : 'Atelier');
      this.pageIndex.set(0);
      if (this.page() === 'dashboard') this.loadDashboard();
      else if (this.page() === 'statistics') this.loadStatistics();
      else if (this.page() === 'settings') this.loadSettings();
      else {
        this.statusOptions.set(
          this.page() === 'orders'
            ? ['COMMANDE', 'COUPE', 'COUTURE', 'FINITION', 'CONTROLE_QUALITE', 'LIVREE']
            : ['PLANIFIEE', 'EN_COURS', 'TERMINEE'],
        );
        this.loadRows();
        this.loadLookups();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  canCreate(): boolean {
    return ['ADMIN', 'MANAGER', 'OPERATOR'].includes(this.auth.role());
  }
  canManage(): boolean {
    return ['ADMIN', 'MANAGER'].includes(this.auth.role());
  }
  search(): void {
    this.pageIndex.set(0);
    this.loadRows();
  }
  changePage(delta: number): void {
    this.pageIndex.update((value) => value + delta);
    this.loadRows();
  }
  stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
  actionTitle(): string {
    const labels: Record<string, string> = {
      'production/start': 'Démarrer la production',
      COUPE: 'Terminer la coupe',
      COUTURE: 'Terminer la couture',
      FINITION: 'Terminer la finition',
      'quality-control': 'Contrôle qualité',
      delivery: 'Enregistrer la livraison',
    };
    return labels[this.actionType()] ?? 'Action sur la commande';
  }

  cell(row: Row, key: string): string {
    const value = row[key];
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'clientId') return this.lookup(this.clients, value);
    if (key === 'productId') return this.lookup(this.products, value);
    if (key === 'orderId') return this.lookup(this.orders, value);
    return String(value);
  }

  startCreate(): void {
    this.editingId.set(null);
    this.openEditor({});
  }

  startEdit(row: Row): void {
    const data: Row = { ...row };
    for (const field of this.fieldsForPage()) {
      if (field.type === 'datetime-local' && typeof data[field.key] === 'string')
        data[field.key] = (data[field.key] as string).slice(0, 16);
    }
    this.editingId.set(Number(row['id']));
    this.openEditor(data);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
  }

  save(): void {
    if (this.editorForm.invalid || this.saving()) return;
    const body = this.editorForm.getRawValue() as Row;
    for (const field of this.fields()) {
      if (
        field.type === 'datetime-local' &&
        typeof body[field.key] === 'string' &&
        body[field.key] &&
        !(body[field.key] as string).includes(':00', 16)
      ) {
        body[field.key] = `${body[field.key]}:00`;
      }
      if (field.options && body[field.key] !== '' && typeof field.options[0]?.value === 'number')
        body[field.key] = Number(body[field.key]);
      if (body[field.key] === '') body[field.key] = null;
    }
    this.saving.set(true);
    const id = this.editingId();
    const request = id ? this.resource().update(id, body) : this.resource().create(body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.loadRows();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(row: Row): void {
    if (!confirm(`Supprimer cet élément${row['name'] ? ` (${row['name']})` : ''} ?`)) return;
    this.resource()
      .delete(Number(row['id']))
      .subscribe({ next: () => this.loadRows() });
  }

  beginAction(row: Row, operation: string): void {
    this.actionOrder.set(row);
    this.actionType.set(operation);
    this.actionForm.reset({
      quantity: null,
      status: 'CONFORME',
      responsible: this.auth.username(),
      comment: '',
      recipient: '',
    });
    const quantity = this.actionForm.controls.quantity;
    quantity.setValidators(
      operation === 'COUPE' || operation === 'COUTURE' || operation === 'FINITION'
        ? [Validators.required, Validators.min(1)]
        : [],
    );
    if (operation === 'COUPE' || operation === 'COUTURE' || operation === 'FINITION')
      quantity.setValue(1);
    this.actionForm.controls.responsible.setValidators(
      operation === 'quality-control' || ['COUPE', 'COUTURE', 'FINITION'].includes(operation)
        ? [Validators.required]
        : [],
    );
    this.actionForm.updateValueAndValidity();
  }

  runAction(): void {
    const order = this.actionOrder();
    if (!order || this.actionForm.invalid || this.saving()) return;
    const operation = this.actionType();
    const request = this.actionForm.getRawValue();
    const payload = {
      quantity: request.quantity ?? undefined,
      status: request.status,
      responsible: request.responsible,
      comment: request.comment,
      recipient: request.recipient,
    };
    const url = this.operations.productionActionUrl(
      Number(order['id']),
      ['COUPE', 'COUTURE', 'FINITION'].includes(operation)
        ? (operation as 'COUPE' | 'COUTURE' | 'FINITION')
        : undefined,
    );
    let task;
    if (operation === 'production/start' || ['COUPE', 'COUTURE', 'FINITION'].includes(operation)) {
      task = this.operations.runProductionAction(url, payload);
    } else {
      const actionUrl =
        operation === 'delivery'
          ? this.orderDeliveryUrl(Number(order['id']))
          : this.orderQualityUrl(Number(order['id']));
      task = this.operations.runProductionAction(actionUrl, payload);
    }
    this.saving.set(true);
    task.subscribe({
      next: () => {
        this.saving.set(false);
        this.actionOrder.set(null);
        this.loadRows();
      },
      error: () => this.saving.set(false),
    });
  }

  loadStatistics(): void {
    this.loading.set(true);
    const { from, to } = this.dateForm.getRawValue();
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    this.operations.statistics(params).subscribe({
      next: (stats: AnalyticsResponse) => {
        this.dashboardMetrics.set(
          Object.entries(stats.metrics ?? {}).map(([key, value]) => [key, Number(value)]),
        );
        this.groups.set(
          Object.entries(stats.groups ?? {}).map(([key, values]) => [
            key,
            values as Record<string, number>,
          ]),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  saveSetting(setting: SettingResponse, rawValue: string): void {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    this.operations.saveSetting({ name: setting.name, value }).subscribe({
      next: () => this.loadSettings(),
    });
  }

  private loadDashboard(): void {
    this.loading.set(true);
    forkJoin({
      stats: this.operations.statistics(),
      delayed: this.operations.delayedOrders(),
    }).subscribe({
      next: ({ stats, delayed }) => {
        this.dashboardMetrics.set(
          Object.entries(stats.metrics ?? {}).map(([key, value]) => [key, Number(value)]),
        );
        this.delayed.set(asRows(delayed.content ?? []));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSettings(): void {
    this.loading.set(true);
    this.operations.settings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadRows(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = { page: this.pageIndex(), size: this.pageSize };
    if (this.query.trim()) params['q'] = this.query.trim();
    if (this.statusFilter) params['status'] = this.statusFilter;
    this.resource()
      .list(params)
      .subscribe({
        next: (page) => {
          this.rows.set(asRows(page.content ?? []));
          this.total.set(page.totalElements ?? 0);
          this.pageCount.set(Math.max(1, page.totalPages ?? 1));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadLookups(): void {
    const needsClients = this.page() === 'orders';
    const needsProducts = this.page() === 'order-lines';
    const needsOrders = ['order-lines', 'production-steps', 'quality-controls'].includes(
      this.page(),
    );
    this.clientsCache = [];
    this.productsCache = [];
    this.ordersCache = [];
    if (needsClients) {
      this.loadLookupPages(
        this.clients as unknown as ApiResourceService<any, any>,
        'name,asc',
        (rows) => (this.clientsCache = rows),
      );
    }
    if (needsProducts) {
      this.loadLookupPages(
        this.products as unknown as ApiResourceService<any, any>,
        'name,asc',
        (rows) => (this.productsCache = rows),
      );
    }
    if (needsOrders) {
      this.loadLookupPages(
        this.orders as unknown as ApiResourceService<any, any>,
        'number,desc',
        (rows) => (this.ordersCache = rows),
      );
    }
  }

  private loadLookupPages(
    service: ApiResourceService<any, any>,
    sort: string,
    assign: (rows: Row[]) => void,
    page = 0,
    accumulated: Row[] = [],
  ): void {
    service.list({ page, size: 100, sort }).subscribe((response) => {
      const rows = [...accumulated, ...asRows(response.content ?? [])];
      if (page + 1 < (response.totalPages ?? 1)) {
        this.loadLookupPages(service, sort, assign, page + 1, rows);
      } else {
        assign(rows);
      }
    });
  }

  private clientsCache: Row[] = [];
  private productsCache: Row[] = [];
  private ordersCache: Row[] = [];

  private lookup(
    service: ClientService | ProductService | TextileOrderService,
    value: unknown,
  ): string {
    const cache =
      service === this.clients
        ? this.clientsCache
        : service === this.products
          ? this.productsCache
          : this.ordersCache;
    const row = cache.find((entry) => Number(entry['id']) === Number(value));
    return row ? String(row['name'] ?? row['number'] ?? value) : String(value);
  }

  private fieldsForPage(): Field[] {
    const clients = this.clientsCache.map((row) => ({
      value: Number(row['id']),
      label: String(row['name']),
    }));
    const products = this.productsCache.map((row) => ({
      value: Number(row['id']),
      label: `${row['reference']} · ${row['name']}`,
    }));
    const orders = this.ordersCache.map((row) => ({
      value: Number(row['id']),
      label: String(row['number']),
    }));
    const definitions: Record<string, Field[]> = {
      clients: [
        { key: 'name', label: 'Nom', required: true },
        { key: 'email', label: 'E-mail', type: 'email', required: true },
        { key: 'phone', label: 'Téléphone', required: true },
        { key: 'address', label: 'Adresse', type: 'textarea', required: true },
      ],
      products: [
        { key: 'name', label: 'Nom du produit', required: true },
        { key: 'reference', label: 'Référence', required: true },
        { key: 'description', label: 'Description', type: 'textarea' },
        {
          key: 'unitPrice',
          label: 'Prix unitaire',
          type: 'number',
          min: 0.01,
          step: 0.01,
          required: true,
        },
      ],
      orders: [
        { key: 'number', label: 'Numéro', required: true },
        { key: 'clientId', label: 'Client', options: clients, required: true },
        { key: 'orderDate', label: 'Date de commande', type: 'date', required: true },
        { key: 'deliveryDate', label: 'Date de livraison', type: 'date', required: true },
        {
          key: 'priority',
          label: 'Priorité',
          options: [
            { value: 'NORMALE', label: 'Normale' },
            { value: 'URGENTE', label: 'Urgente' },
            { value: 'TRES_URGENTE', label: 'Très urgente' },
          ],
          required: true,
        },
      ],
      'order-lines': [
        { key: 'orderId', label: 'Commande', options: orders, required: true },
        { key: 'productId', label: 'Produit', options: products, required: true },
        { key: 'quantity', label: 'Quantité', type: 'number', min: 1, required: true },
        { key: 'size', label: 'Taille', required: true },
        { key: 'color', label: 'Couleur', required: true },
        {
          key: 'unitPrice',
          label: 'Prix unitaire',
          type: 'number',
          min: 0.01,
          step: 0.01,
          required: true,
        },
      ],
      'production-steps': [
        { key: 'orderId', label: 'Commande', options: orders, required: true },
        {
          key: 'type',
          label: 'Étape',
          options: [
            { value: 'COUPE', label: 'Coupe' },
            { value: 'COUTURE', label: 'Couture' },
            { value: 'FINITION', label: 'Finition' },
          ],
          required: true,
        },
        { key: 'responsible', label: 'Responsable', required: true },
        { key: 'plannedStart', label: 'Début planifié', type: 'datetime-local', required: true },
        { key: 'plannedEnd', label: 'Fin planifiée', type: 'datetime-local', required: true },
        { key: 'comment', label: 'Commentaire', type: 'textarea' },
      ],
      'quality-controls': [
        { key: 'orderId', label: 'Commande', options: orders, required: true },
        {
          key: 'result',
          label: 'Résultat',
          options: [
            { value: 'CONFORME', label: 'Conforme' },
            { value: 'NON_CONFORME', label: 'Non conforme' },
          ],
          required: true,
        },
        { key: 'responsible', label: 'Responsable', required: true },
        { key: 'comment', label: 'Commentaire', type: 'textarea' },
      ],
    };
    return definitions[this.page()] ?? [];
  }

  columns(): Field[] {
    const definitions: Record<string, Field[]> = {
      clients: [
        { key: 'name', label: 'Nom' },
        { key: 'email', label: 'E-mail' },
        { key: 'phone', label: 'Téléphone' },
        { key: 'address', label: 'Adresse' },
      ],
      products: [
        { key: 'reference', label: 'Référence' },
        { key: 'name', label: 'Produit' },
        { key: 'description', label: 'Description' },
        { key: 'unitPrice', label: 'Prix' },
      ],
      orders: [
        { key: 'number', label: 'Commande' },
        { key: 'clientId', label: 'Client' },
        { key: 'orderDate', label: 'Créée le' },
        { key: 'deliveryDate', label: 'Livraison prévue' },
        { key: 'priority', label: 'Priorité' },
        { key: 'status', label: 'Statut' },
      ],
      'order-lines': [
        { key: 'orderId', label: 'Commande' },
        { key: 'productId', label: 'Produit' },
        { key: 'quantity', label: 'Quantité' },
        { key: 'producedQuantity', label: 'Produite' },
        { key: 'size', label: 'Taille' },
        { key: 'color', label: 'Couleur' },
        { key: 'unitPrice', label: 'Prix' },
      ],
      'production-steps': [
        { key: 'orderId', label: 'Commande' },
        { key: 'type', label: 'Étape' },
        { key: 'responsible', label: 'Responsable' },
        { key: 'plannedStart', label: 'Début prévu' },
        { key: 'plannedEnd', label: 'Fin prévue' },
        { key: 'status', label: 'Statut' },
        { key: 'quantity', label: 'Quantité' },
      ],
      'quality-controls': [
        { key: 'orderId', label: 'Commande' },
        { key: 'result', label: 'Résultat' },
        { key: 'responsible', label: 'Responsable' },
        { key: 'checkedAt', label: 'Contrôlé le' },
        { key: 'comment', label: 'Commentaire' },
      ],
    };
    return definitions[this.page()] ?? [];
  }

  private openEditor(data: Row): void {
    const fields = this.fieldsForPage();
    this.fields.set(fields);
    for (const key of Object.keys(this.editorForm.controls)) this.editorForm.removeControl(key);
    for (const field of fields) {
      const value = data[field.key] ?? this.defaultValue(field);
      const validators = field.required
        ? [Validators.required, ...(field.type === 'email' ? [Validators.email] : [])]
        : [];
      this.editorForm.addControl(field.key, new FormControl(value, validators));
    }
    this.editorOpen.set(true);
  }

  private defaultValue(field: Field): unknown {
    if (field.key === 'orderDate') return today();
    if (field.key === 'deliveryDate')
      return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    if (field.key === 'plannedStart') return new Date().toISOString().slice(0, 16);
    if (field.key === 'plannedEnd')
      return new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    if (field.key === 'priority') return 'NORMALE';
    if (field.key === 'result') return 'CONFORME';
    if (field.key === 'type') return 'COUPE';
    if (field.type === 'number') return null;
    return '';
  }

  private resource(): ApiResourceService<any, any> {
    switch (this.page()) {
      case 'clients':
        return this.clients as unknown as ApiResourceService<any, any>;
      case 'products':
        return this.products as unknown as ApiResourceService<any, any>;
      case 'orders':
        return this.orders as unknown as ApiResourceService<any, any>;
      case 'order-lines':
        return this.lines as unknown as ApiResourceService<any, any>;
      case 'production-steps':
        return this.steps as unknown as ApiResourceService<any, any>;
      default:
        return this.quality as unknown as ApiResourceService<any, any>;
    }
  }

  private orderDeliveryUrl(id: number): string {
    return API_ENDPOINTS.orderDelivery(id);
  }
  private orderQualityUrl(id: number): string {
    return API_ENDPOINTS.orderQualityControl(id);
  }
}
