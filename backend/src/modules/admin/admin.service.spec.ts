import { Test, TestingModule } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { beforeEach, describe, it } from "node:test";

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // it('should be defined', () => {
  //   expect(service).toBeDefined();
  // });
});
