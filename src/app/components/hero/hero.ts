import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.html',
  styleUrls: ['./hero.css']
})
export class HeroComponent implements AfterViewInit {
  @ViewChild('bgVideo') videoElement!: ElementRef<HTMLVideoElement>;

  ngAfterViewInit() {
    if (this.videoElement) {
      const video = this.videoElement.nativeElement;
      video.muted = true;
      video.play().catch(err => {
        console.warn('Autoplay prevented, retrying on first interaction or sticking to manual:', err);
      });
    }
  }
}
