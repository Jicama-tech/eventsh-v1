import { Module, forwardRef } from "@nestjs/common";
import { OperatorsService } from "./operators.service";
import { OperatorsController } from "./operators.controller";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { Operator, OperatorSchema } from "./entities/operator.entity";
import { OrganizersModule } from "../organizers/organizers.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
    ]),
    forwardRef(() => OrganizersModule),
  ],
  controllers: [OperatorsController],
  providers: [OperatorsService],
})
export class OperatorsModule {}
