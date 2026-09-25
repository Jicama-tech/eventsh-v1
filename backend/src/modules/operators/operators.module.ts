import { Module, forwardRef } from "@nestjs/common";
import { OperatorsService } from "./operators.service";
import { OperatorsController } from "./operators.controller";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { Operator, OperatorSchema } from "./entities/operator.entity";
import { OrganizersModule } from "../organizers/organizers.module";
import {
  EventAgent,
  EventAgentSchema,
} from "../event-agents/schemas/event-agent.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      // resolveReferral credits event agents' codes too (model only — no
      // import of EventAgentsModule, which would deepen the module graph).
      { name: EventAgent.name, schema: EventAgentSchema },
    ]),
    forwardRef(() => OrganizersModule),
  ],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
