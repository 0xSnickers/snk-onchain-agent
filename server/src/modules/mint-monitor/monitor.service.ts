import { Injectable } from "@nestjs/common";
import { DetectionService } from "../delegation/detection.service";
@Injectable()
export class MonitorService {
  constructor(private readonly detection: DetectionService) {}
  start() {
    return this.detection.scan();
  }
}
