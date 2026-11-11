import { provideHttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

@Component({ template: '<footer class="landing-footer">Footer de Home</footer>' })
class HomeTestPage {}

@Component({ template: '<p>Otra página</p>' })
class OtherTestPage {}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: '', component: HomeTestPage },
          { path: 'otra', component: OtherTestPage },
        ]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the navbar', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).toBeTruthy();
  });

  it('evita duplicar el footer en Home y muestra el global en otras rutas', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('footer')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.landing-footer')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-footer')).toBeNull();

    await router.navigateByUrl('/otra');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('footer')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('app-footer .site-footer')).toBeTruthy();
  });
});
