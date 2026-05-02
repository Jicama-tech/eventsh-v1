import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AgentsService } from "./agents.service";
import { AgentsController } from "./agents.controller";
import { Agent, AgentSchema } from "./schemas/agent.schema";
import {
  Organizer,
  OrganizerSchema,
} from "../organizers/schemas/organizer.schema";
import { EventSchema } from "../events/schemas/event.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: Organizer.name, schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
    ]),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService, MongooseModule],
})
export class AgentsModule {}
