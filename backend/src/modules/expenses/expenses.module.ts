import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExpensesService } from "./expenses.service";
import { ExpensesController } from "./expenses.controller";
import {
  EventExpense,
  EventExpenseSchema,
} from "./entities/event-expense.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventExpense.name, schema: EventExpenseSchema },
      // Resolves the owning organizer so it's never taken from the client.
      { name: "Event", schema: EventSchema },
      // Approval permission lives on the operator record.
      { name: "Operator", schema: OperatorSchema },
      // Country → currency for the amounts shown.
      { name: "Organizer", schema: OrganizerSchema },
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
