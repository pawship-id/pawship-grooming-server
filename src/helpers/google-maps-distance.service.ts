import { Injectable, Logger } from '@nestjs/common';
import {
  Client,
  TravelMode,
  UnitSystem,
  Status,
} from '@googlemaps/google-maps-services-js';

@Injectable()
export class GoogleMapsDistanceService {
  private readonly logger = new Logger(GoogleMapsDistanceService.name);
  private readonly client = new Client({});

  /**
   * Get driving route distance in km between two coordinates using Google Maps
   * Distance Matrix API. Falls back to haversine straight-line distance if the
   * API is unavailable or not configured.
   */
  async getRouteDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): Promise<number> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'GOOGLE_MAPS_API_KEY not set — falling back to haversine distance',
      );
      return this.haversineKm(lat1, lon1, lat2, lon2);
    }

    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [{ lat: lat1, lng: lon1 }],
          destinations: [{ lat: lat2, lng: lon2 }],
          mode: TravelMode.driving,
          units: UnitSystem.metric,
          key: apiKey,
        },
      });

      const element = response.data?.rows?.[0]?.elements?.[0];

      if (
        response.data.status === Status.OK &&
        element?.status === Status.OK &&
        element.distance?.value != null
      ) {
        return element.distance.value / 1000; // metres → km
      }

      this.logger.warn(
        `Distance Matrix returned status "${element?.status ?? response.data.status}" — falling back to haversine`,
      );
    } catch (err) {
      this.logger.warn(
        `Distance Matrix API error: ${(err as Error).message} — falling back to haversine`,
      );
    }

    return this.haversineKm(lat1, lon1, lat2, lon2);
  }

  /** Haversine great-circle distance in km */
  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
