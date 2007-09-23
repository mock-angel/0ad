/**
 * =========================================================================
 * File        : wcpu.h
 * Project     : 0 A.D.
 * Description : Windows backend for CPU related code
 * =========================================================================
 */

// license: GPL; see lib/license.txt

#ifndef INCLUDED_WCPU
#define INCLUDED_WCPU

#include "lib/sysdep/cpu.h"

extern uint wcpu_NumProcessors();
extern double wcpu_ClockFrequency();

extern LibError wcpu_CallByEachCPU(CpuCallback cb, void* param);

extern size_t wcpu_PageSize();
extern size_t wcpu_MemorySize(CpuMemoryIndicators mem_type);

#endif	// #ifndef INCLUDED_WCPU
